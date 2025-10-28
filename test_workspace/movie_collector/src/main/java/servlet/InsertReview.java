package servlet;

import java.io.IOException;

import javax.servlet.RequestDispatcher;
import javax.servlet.ServletException;
import javax.servlet.annotation.WebServlet;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import javax.servlet.http.HttpSession;

import dao.MovieDAO;
import model.Member;
import model.Review;

@WebServlet("/insertReview")
public class InsertReview extends HttpServlet {
	private static final long serialVersionUID = 1L;

	protected void doGet(HttpServletRequest request, HttpServletResponse response) throws ServletException, IOException {
		insertReview(request, response);
	}

	protected void doPost(HttpServletRequest request, HttpServletResponse response) throws ServletException, IOException {
		insertReview(request, response);
	}

	protected void insertReview(HttpServletRequest request, HttpServletResponse response) throws ServletException, IOException {
		request.setCharacterEncoding("UTF-8");
		MovieDAO dao = new MovieDAO();
		HttpSession session = request.getSession();
		Member nowUser = (Member) session.getAttribute("member");
		//로그인이 안 됐다면 로그인 창으로 이동
		if (nowUser == null) {
			response.sendRedirect("login.jsp");
			return;
		}
		//리뷰 삽입
		Review newReview = new Review();
		newReview.setMovie_code(request.getParameter("movieCd"));
		newReview.setReview(request.getParameter("review"));
		newReview.setScore(request.getParameter("score"));
		newReview.setMember_seq(nowUser.getMember_seq());
		dao.insertReview(newReview);
		//이동
//		response.sendRedirect(request.getContextPath() + "/movieDetail.do?movieCd=" + request.getParameter("movieCd"));
		RequestDispatcher dis = request.getRequestDispatcher("movieDetail.do?movieCd=" + request.getParameter("movieCd"));//작업 처리 후 HTML이나 JSP등을 보내줌
		dis.forward(request, response);
	};
}
